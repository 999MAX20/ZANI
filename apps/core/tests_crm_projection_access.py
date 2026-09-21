"""AUD-027: permission equivalence of direct and nested CRM reads."""
from datetime import timedelta
import json

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.activities.models import ActivityEvent, Note, Tag, TaggedObject
from apps.bots.models import Bot, BotConversation
from apps.businesses.models import (
    Business, BusinessCapability, BusinessMember, BusinessRole, RolePermission, Team, TeamMember,
)
from apps.clients.models import Client
from apps.core.models import CustomFieldDefinition, CustomFieldValue, FileAttachment
from apps.crm.models import Deal, Pipeline, PipelineStage
from apps.leads.models import Lead
from apps.scheduling.models import Appointment, Resource
from apps.services.models import Service
from apps.tasks.models import Task


class CrmProjectionAccessTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(username='projection-owner', email='projection-owner@example.test', password='test-pass-027')
        cls.other_owner = User.objects.create_user(username='projection-foreign', email='projection-foreign@example.test', password='test-pass-027')
        cls.business = Business.objects.create(owner=cls.owner, name='Projection A', slug='projection-a')
        cls.foreign = Business.objects.create(owner=cls.other_owner, name='Projection B', slug='projection-b')
        for key in ('owner', 'manager', 'operator', 'specialist', 'admin', 'support'):
            user = cls.owner if key == 'owner' else User.objects.create_user(username=f'projection-{key}', email=f'projection-{key}@example.test', password='test-pass-027')
            setattr(cls, key, user)
            member = BusinessMember.objects.create(business=cls.business, user=user, role=key)
            setattr(cls, f'{key}_member', member)
        BusinessMember.objects.create(business=cls.foreign, user=cls.other_owner, role='owner')
        cls.team = Team.objects.create(business=cls.business, name='Projection team')
        for key in ('manager', 'operator'):
            TeamMember.objects.create(team=cls.team, member=getattr(cls, f'{key}_member'))
        cls.customer = Client.objects.create(business=cls.business, full_name='Projection customer')
        cls.pipeline = Pipeline.objects.create(business=cls.business, name='Projection pipeline', slug='projection')
        cls.stage = PipelineStage.objects.create(business=cls.business, pipeline=cls.pipeline, name='Open')
        cls.service = Service.objects.create(business=cls.business, name='Projection service', duration_minutes=30)
        for key, user in (('visible', cls.operator), ('hidden', cls.owner)):
            lead = Lead.objects.create(business=cls.business, client=cls.customer, responsible_user=user)
            deal = Deal.objects.create(business=cls.business, client=cls.customer, lead=lead,
                                      pipeline=cls.pipeline, stage=cls.stage, title=f'{key}-deal-secret', owner=user, amount=1234)
            resource = Resource.objects.create(business=cls.business, name=f'{key}-resource',
                                                linked_user=cls.specialist if key == 'visible' else cls.owner)
            appointment = Appointment.objects.create(business=cls.business, client=cls.customer, lead=lead,
                service=cls.service, resource=resource, start_at=timezone.now() + timedelta(days=2),
                end_at=timezone.now() + timedelta(days=2, minutes=30), notes=f'{key}-appointment-secret')
            task = Task.objects.create(business=cls.business, client=cls.customer, lead=lead, deal=deal,
                                       appointment=appointment, title=f'{key}-task-secret', assignee=user, created_by=user)
            for name, obj in (('lead', lead), ('deal', deal), ('appointment', appointment), ('task', task)):
                setattr(cls, f'{key}_{name}', obj)
            event = ActivityEvent.objects.create(business=cls.business, client=cls.customer,
                event_type='task.created', entity_type='Task', entity_id=str(task.id), text=f'{key}-activity-secret')
            note = Note.objects.create(business=cls.business, client=cls.customer,
                entity_type='task', entity_id=str(task.id), text=f'{key}-note-secret')
            attachment = FileAttachment.objects.create(business=cls.business, uploaded_by=cls.owner,
                file=f'aud027/{key}.txt', original_name=f'{key}-attachment-secret', entity_type='task', entity_id=str(task.id))
            tag = Tag.objects.create(business=cls.business, name=f'{key}-tag-secret')
            TaggedObject.objects.create(business=cls.business, tag=tag, entity_type='task', entity_id=str(task.id))
            for name, obj in (('event', event), ('note', note), ('attachment', attachment)):
                setattr(cls, f'{key}_{name}', obj)
        cls.bot = Bot.objects.create(business=cls.business, name='Projection bot')
        cls.conversation = BotConversation.objects.create(business=cls.business, bot=cls.bot,
            client=cls.customer, external_user_id='projection-visitor', assigned_to=cls.owner)
        cls.restricted = CustomFieldDefinition.objects.create(business=cls.business, entity_type='client',
            key='owner-only', label='owner-field-secret', permissions_json={'view_roles': ['owner'], 'edit_roles': ['owner']})
        cls.public = CustomFieldDefinition.objects.create(business=cls.business, entity_type='client',
            key='shared', label='Shared field')
        for definition in (cls.restricted, cls.public):
            CustomFieldValue.objects.create(business=cls.business, definition=definition, entity_type='client',
                entity_id=str(cls.customer.id), value_json={'value': definition.label})

    def setUp(self):
        self.api = APIClient()

    def card(self, actor, kind='clients', obj=None):
        self.api.force_authenticate(actor)
        response = self.api.get(f'/api/{kind}/{(obj or self.customer).id}/crm-card/')
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_operator_card_matches_direct_task_scope_before_counts_and_limits(self):
        self.api.force_authenticate(self.operator)
        self.assertEqual(self.api.get(f'/api/tasks/{self.hidden_task.id}/').status_code, 404)
        data = self.card(self.operator)
        self.assertEqual([row['id'] for row in data['tasks']], [self.visible_task.id])
        self.assertEqual(data['meta']['related_counts']['tasks'], 1)
        self.assertEqual(data['client']['tasks_count'], 1)
        self.assertNotIn('hidden-task-secret', json.dumps(data))

    def test_manager_nested_deals_and_pipeline_board_preserve_team_scope(self):
        self.api.force_authenticate(self.manager)
        self.assertEqual(self.api.get(f'/api/deals/{self.hidden_deal.id}/').status_code, 404)
        response = self.api.get(f'/api/pipelines/{self.pipeline.id}/board/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual([d['id'] for s in response.data['stages'] for d in s['deals']], [self.visible_deal.id])
        data = self.card(self.manager)
        self.assertEqual([row['id'] for row in data['deals']], [self.visible_deal.id])
        self.assertEqual(data['deal']['id'], self.visible_deal.id)

    def test_specialist_appointment_card_excludes_inaccessible_siblings_and_deals(self):
        self.api.force_authenticate(self.specialist)
        self.assertEqual(self.api.get(f'/api/appointments/{self.hidden_appointment.id}/').status_code, 404)
        data = self.card(self.specialist, 'appointments', self.visible_appointment)
        self.assertEqual([row['id'] for row in data['appointments']], [self.visible_appointment.id])
        self.assertIsNone(data['deal'])
        self.assertEqual(data['deals'], [])
        self.assertNotIn('hidden-appointment-secret', json.dumps(data))

    def test_hidden_entity_cannot_reenter_card_through_client_activity_or_auxiliary_rows(self):
        data = self.card(self.operator)
        self.assertNotIn('hidden-activity-secret', json.dumps(data['timeline']))
        self.assertNotIn('hidden-note-secret', json.dumps(data['notes']))
        self.assertNotIn('hidden-attachment-secret', json.dumps(data['attachments']))
        self.assertNotIn('hidden-tag-secret', json.dumps(data['tags']))
        self.assertEqual(data['meta']['related_counts']['timeline'], 1)
        self.assertEqual(data['meta']['related_counts']['notes'], 1)
        self.assertIn('visible-activity-secret', json.dumps(data['timeline']))

    def test_custom_field_view_roles_apply_to_nested_definitions_and_values(self):
        self.api.force_authenticate(self.manager)
        self.assertEqual(self.api.get(f'/api/custom-fields/{self.restricted.id}/').status_code, 404)
        data = self.card(self.manager)
        self.assertEqual([row['definition']['id'] for row in data['custom_fields']], [self.public.id])
        self.assertNotIn('owner-field-secret', json.dumps(data))

    def test_disabled_tasks_disappear_from_all_card_projections(self):
        BusinessCapability.objects.update_or_create(business=self.business, module_key='tasks', defaults={'is_enabled': False})
        data = self.card(self.owner)
        self.assertEqual(data['tasks'], [])
        self.assertEqual(data['meta']['related_counts']['tasks'], 0)
        self.assertEqual(data['client']['tasks_count'], 0)
        self.assertNotIn('task-secret', json.dumps(data))
        self.assertEqual(data['timeline'], [])
        self.assertEqual(data['notes'], [])

    def test_owner_and_admin_keep_permitted_context_and_foreign_tenant_stays_denied(self):
        for actor in (self.owner, self.admin):
            data = self.card(actor)
            self.assertEqual({row['id'] for row in data['tasks']}, {self.visible_task.id, self.hidden_task.id})
            self.assertEqual(data['meta']['related_counts']['tasks'], 2)
            self.assertEqual(len(data['timeline']), 2)
        self.api.force_authenticate(self.other_owner)
        self.assertEqual(self.api.get(f'/api/clients/{self.customer.id}/crm-card/').status_code, 404)
        self.assertEqual(self.api.get(f'/api/pipelines/{self.pipeline.id}/board/').status_code, 404)

    def test_pipeline_board_uses_actor_for_sensitive_field_redaction(self):
        self.api.force_authenticate(self.support)
        direct = self.api.get(f'/api/deals/{self.hidden_deal.id}/')
        self.assertEqual(direct.status_code, 200)
        self.assertIsNone(direct.data['amount'])
        response = self.api.get(f'/api/pipelines/{self.pipeline.id}/board/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(all(d['amount'] is None for s in response.data['stages'] for d in s['deals']))

    def test_explicit_deny_and_membership_revocation_are_not_bypassed_by_parent(self):
        role = BusinessRole.objects.create(business=self.business, name='Denied tasks')
        RolePermission.objects.create(business_role=role, resource='tasks', action='view', is_allowed=False)
        self.manager_member.business_role = role
        self.manager_member.save(update_fields=['business_role'])
        data = self.card(self.manager)
        self.assertEqual(data['tasks'], [])
        self.assertNotIn('task-secret', json.dumps(data))
        self.manager_member.is_active = False
        self.manager_member.save(update_fields=['is_active'])
        self.assertIn(self.api.get(f'/api/clients/{self.customer.id}/crm-card/').status_code, (403, 404))

    def test_counts_and_limit_are_applied_after_scope(self):
        Task.objects.bulk_create([
            Task(business=self.business, client=self.customer, title=f'hidden-extra-{index}',
                 assignee=self.owner, created_by=self.owner) for index in range(30)
        ])
        data = self.card(self.operator)
        self.assertEqual([row['id'] for row in data['tasks']], [self.visible_task.id])
        self.assertEqual(data['meta']['related_counts']['tasks'], 1)
        self.assertFalse(data['meta']['has_more']['tasks'])
        self.assertNotIn('hidden-extra', json.dumps(data))

    def test_primary_deal_next_task_cannot_disclose_another_owners_task(self):
        Task.objects.filter(pk=self.hidden_task.pk).update(deal=self.visible_deal, due_at=timezone.now())
        Task.objects.filter(pk=self.visible_task.pk).update(due_at=timezone.now() + timedelta(days=1))
        data = self.card(self.manager, 'deals', self.visible_deal)
        self.assertEqual(data['deal']['next_task_id'], self.visible_task.pk)
        self.assertNotIn('hidden-task-secret', json.dumps(data, default=str))

    def test_timeline_detail_search_count_and_actor_choices_share_entity_scope(self):
        ActivityEvent.objects.filter(pk=self.hidden_event.pk).update(actor=self.owner)
        ActivityEvent.objects.filter(pk=self.visible_event.pk).update(actor=self.operator)
        self.api.force_authenticate(self.manager)
        path = '/api/activity-events/'
        for params in ({}, {'business': self.business.pk}, {'client': self.customer.pk}):
            response = self.api.get(path, params)
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data['count'], 1)
            self.assertEqual(response.data['results'][0]['id'], self.visible_event.pk)
        self.assertEqual(self.api.get(f'{path}{self.hidden_event.pk}/').status_code, 404)
        self.assertEqual(self.api.get(path, {'q': 'hidden-activity-secret'}).data['count'], 0)
        actors = self.api.get(f'{path}actors/', {'selected_actor': self.owner.pk}).data
        self.assertEqual([row['id'] for row in actors['results']], [self.operator.pk])
        self.assertIsNone(actors['selected_actor'])

    def test_custom_conversation_own_scope_and_disabled_analytics_remain_independent(self):
        role = BusinessRole.objects.create(business=self.business, name='Own conversations')
        RolePermission.objects.create(business_role=role, resource='conversations', action='view',
                                      is_allowed=True, scope='own')
        self.manager_member.business_role = role
        self.manager_member.save(update_fields=['business_role'])
        self.assertEqual(self.card(self.manager)['conversations'], [])
        BotConversation.objects.filter(pk=self.conversation.pk).update(assigned_to=self.manager)
        self.assertEqual(self.card(self.manager)['conversations'][0]['id'], self.conversation.pk)
        BusinessCapability.objects.update_or_create(business=self.business, module_key='analytics', defaults={'is_enabled': False})
        self.assertEqual(self.api.get('/api/activity-events/', {'business': self.business.pk}).status_code, 403)

    def test_card_builder_requires_actor_even_outside_http(self):
        from rest_framework.exceptions import PermissionDenied
        from apps.core.crm_cards import client_crm_card

        with self.assertRaises(PermissionDenied):
            client_crm_card(self.customer)

    def test_client_list_and_detail_use_the_same_scoped_counts_and_next_step(self):
        self.api.force_authenticate(self.operator)
        for path in ('/api/clients/', f'/api/clients/{self.customer.pk}/'):
            response = self.api.get(path)
            self.assertEqual(response.status_code, 200)
            row = response.data['results'][0] if 'results' in response.data else response.data
            self.assertEqual(row['tasks_count'], 1)
            self.assertNotIn('hidden-task-secret', json.dumps(response.data))

    def test_deal_list_does_not_reintroduce_hidden_task_preview(self):
        Task.objects.filter(pk=self.hidden_task.pk).update(deal=self.visible_deal, due_at=timezone.now())
        Task.objects.filter(pk=self.visible_task.pk).update(due_at=timezone.now() + timedelta(days=1))
        self.api.force_authenticate(self.manager)
        response = self.api.get('/api/deals/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['results'][0]['next_task_id'], self.visible_task.pk)
        self.assertNotIn('hidden-task-secret', json.dumps(response.data, default=str))

    def test_client_annotations_reject_foreign_back_references_for_multi_business_actor(self):
        BusinessMember.objects.create(business=self.foreign, user=self.owner, role='admin')
        Task.objects.create(business=self.foreign, client=self.customer, assignee=self.owner,
                            created_by=self.owner, title='foreign-back-reference-secret')
        self.api.force_authenticate(self.owner)
        response = self.api.get(f'/api/clients/{self.customer.pk}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['tasks_count'], 2)
        self.assertNotIn('foreign-back-reference-secret', json.dumps(response.data))
