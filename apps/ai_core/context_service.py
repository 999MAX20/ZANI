from apps.ai_core.models import BusinessKnowledgeItem
import re


def get_business_knowledge_context(business, limit=8, query=""):
    # Bounded lexical retrieval; Unicode casefold behaves consistently on SQLite/Postgres.
    items = list(BusinessKnowledgeItem.objects.filter(business=business, is_active=True).order_by("category", "title")[:500])
    words = list(dict.fromkeys(re.findall(r"[^\W_]{3,}", query.casefold())))[:24]
    def relevance(item):
        title, content = item.title.casefold(), item.content.casefold()
        return sum(3 * (word in title) + (word in content) for word in words)
    chosen = sorted(items, key=relevance, reverse=True)[:limit]
    return [
        {
            "id": item.id,
            "title": item.title,
            "category": item.category,
            "content": item.content,
        }
        for item in chosen
    ]
