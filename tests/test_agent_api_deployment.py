from __future__ import annotations

import os
import unittest
from pathlib import Path
from unittest.mock import patch

from market_news_report.config import AppConfig


class AgentApiDeploymentConfigTests(unittest.TestCase):
    def test_default_paths_are_repository_relative(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        with patch.dict(
            os.environ,
            {"WORKSPACE_ROOT": "", "REPORT_OUTPUT_DIR": ""},
        ):
            config = AppConfig()

        self.assertEqual(config.workspace_root, project_root)
        self.assertEqual(config.report_output_dir, project_root / "reports")

    def test_environment_paths_support_relative_report_directory(self) -> None:
        workspace = Path.cwd() / "cloud-workspace"
        with patch.dict(
            os.environ,
            {"WORKSPACE_ROOT": str(workspace), "REPORT_OUTPUT_DIR": "runtime-reports"},
        ):
            config = AppConfig()

        self.assertEqual(config.workspace_root, workspace)
        self.assertEqual(config.report_output_dir, workspace / "runtime-reports")

    def test_cors_origins_keep_local_defaults_and_add_configured_origins(self) -> None:
        with patch.dict(
            os.environ,
            {
                "CORS_ORIGINS": (
                    "https://market.example.com, "
                    "https://codex-v2.vercel.app,"
                    "https://market.example.com"
                )
            },
        ):
            config = AppConfig()

        self.assertEqual(
            config.cors_origins,
            (
                "http://127.0.0.1:5173",
                "http://localhost:5173",
                "https://market.example.com",
                "https://codex-v2.vercel.app",
            ),
        )

    def test_cors_origins_reject_wildcard(self) -> None:
        with patch.dict(os.environ, {"CORS_ORIGINS": "*"}):
            with self.assertRaisesRegex(ValueError, "must not contain"):
                AppConfig()


if __name__ == "__main__":
    unittest.main()
