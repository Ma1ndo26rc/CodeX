from __future__ import annotations

import unittest
from datetime import datetime, timezone

from market_news_report.intelligence import (
    build_market_events,
    calculate_final_score,
    enrich_news_items,
    source_quality_score,
)


class IntelligenceTests(unittest.TestCase):
    def test_source_quality_tiers(self) -> None:
        self.assertGreater(source_quality_score("Reuters"), source_quality_score("CNBC"))
        self.assertGreater(source_quality_score("CNBC"), source_quality_score("TradingKey"))

    def test_final_score_formula(self) -> None:
        self.assertEqual(calculate_final_score(80, 100, 90, 75, 80), 85.0)

    def test_soft_product_news_is_low_priority(self) -> None:
        items = enrich_news_items(
            [self._article("Apple TV series review and product comparison", "PCMag")],
            now=datetime(2026, 6, 28, tzinfo=timezone.utc),
        )
        event = build_market_events(items)[0]
        self.assertEqual(event["priority_level"], "Low")
        self.assertLessEqual(event["market_impact_score"], 38)

    def test_similar_multi_source_articles_cluster(self) -> None:
        items = enrich_news_items(
            [
                self._article("OpenAI delays IPO until 2027, pressuring AI stocks", "CNBC"),
                self._article("OpenAI IPO delayed to 2027 as AI shares fall", "Yahoo Finance"),
            ],
            now=datetime(2026, 6, 28, tzinfo=timezone.utc),
        )
        events = build_market_events(items)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["source_count"], 2)
        self.assertGreater(events[0]["cross_source_frequency"], 20)

    @staticmethod
    def _article(title: str, source: str) -> dict:
        return {
            "title": title,
            "summary": title,
            "category": "company",
            "sentiment": "neutral",
            "source_name": source,
            "source_url": f"https://example.com/{source.lower().replace(' ', '-')}",
            "published_at": "2026-06-27T23:00:00+00:00",
            "tickers": [],
            "keywords": [],
        }


if __name__ == "__main__":
    unittest.main()
