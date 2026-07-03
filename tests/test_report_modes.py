import json
import tempfile
import unittest
from pathlib import Path

from market_news_report.analysis_schema import apply_report_metadata, parse_and_validate_market_json, save_market_analysis


class ReportModeTests(unittest.TestCase):
    def test_report_metadata_is_validated(self):
        report = parse_and_validate_market_json(
            {
                "report_type": "premarket",
                "report_label": "Pre-Market Brief",
                "generated_at": "2026-07-03T12:30:00+00:00",
                "market_session": "US Pre-Market",
                "source_window": "Previous 24 hours through the pre-market cutoff",
                "data_freshness_warning": True,
            }
        )

        self.assertEqual(report["report_type"], "premarket")
        self.assertEqual(report["report_label"], "Pre-Market Brief")
        self.assertTrue(report["data_freshness_warning"])

    def test_saves_two_reports_for_the_same_date(self):
        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory)
            base = {"dynamic_headline": "Test brief", "key_events": []}

            premarket = apply_report_metadata(base, "premarket")
            premarket["generated_at"] = "2026-07-03T12:30:00+00:00"
            save_market_analysis(premarket, output_dir)

            close = apply_report_metadata(base, "close")
            close["generated_at"] = "2026-07-03T22:00:00+00:00"
            save_market_analysis(close, output_dir)

            self.assertTrue((output_dir / "premarket.json").exists())
            self.assertTrue((output_dir / "close.json").exists())
            self.assertTrue((output_dir / "history" / "2026-07-03-premarket.json").exists())
            self.assertTrue((output_dir / "history" / "2026-07-03-close.json").exists())

            index = json.loads((output_dir / "history_index.json").read_text(encoding="utf-8"))
            self.assertEqual({item["report_type"] for item in index["reports"]}, {"premarket", "close"})
            latest = json.loads((output_dir / "latest.json").read_text(encoding="utf-8"))
            self.assertEqual(latest["report_type"], "close")


if __name__ == "__main__":
    unittest.main()
