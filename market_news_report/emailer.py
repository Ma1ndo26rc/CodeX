from __future__ import annotations

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

from .config import CONFIG


def send_report_email(subject: str, body_md: str, attachment_paths: list[Path] | None = None) -> None:
    if not CONFIG.enable_email:
        return
    if not all([CONFIG.smtp_host, CONFIG.smtp_user, CONFIG.smtp_password, CONFIG.smtp_from, CONFIG.smtp_to]):
        raise ValueError("SMTP settings are incomplete.")

    msg = MIMEMultipart()
    msg["From"] = CONFIG.smtp_from
    msg["To"] = CONFIG.smtp_to
    msg["Subject"] = subject
    msg.attach(MIMEText(body_md, "plain", "utf-8"))

    with smtplib.SMTP(CONFIG.smtp_host, CONFIG.smtp_port) as server:
        server.starttls()
        server.login(CONFIG.smtp_user, CONFIG.smtp_password)
        server.sendmail(CONFIG.smtp_from, [CONFIG.smtp_to], msg.as_string())
