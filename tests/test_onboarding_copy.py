"""Onboarding copy must not use decorative highlight beans."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAP = ROOT / "frontend/src/lib/platformCapabilityMap.js"


def test_intro_slides_drop_highlight_beans():
    text = CAP.read_text(encoding="utf-8")
    assert "Signal lanes" not in text
    assert "highlights:" not in text
    assert "tag: 'Observe'" in text


def test_register_marks_onboarding_pending():
    src = (ROOT / "frontend/src/pages/RegisterPage.jsx").read_text(encoding="utf-8")
    assert "markOnboardingPending" in src
    login = (ROOT / "frontend/src/pages/LoginPage.jsx").read_text(encoding="utf-8")
    assert "shouldRunOnboarding" in login
    assert "/app/onboarding" in login
