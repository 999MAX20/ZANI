from apps.ai_core.models import BusinessKnowledgeItem


def get_business_knowledge_context(business, limit=8):
    items = (
        BusinessKnowledgeItem.objects.filter(business=business, is_active=True)
        .order_by("category", "title")[:limit]
    )
    return [
        {
            "title": item.title,
            "category": item.category,
            "content": item.content,
        }
        for item in items
    ]
