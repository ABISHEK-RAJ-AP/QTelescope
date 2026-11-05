"""Onboarding copy must not use decorative highlight beans."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAP = ROOT / "frontend/src/lib/platformCapabilityMap.js"


def test_intro_slides_drop_highlight_beans():
    text = CAP.read_text(encoding="utf-8")
    assert "Signal lanes" not in text
    assert "highlights:" not in text
    assert "tag: 'Observe'" in text
    assert "marketing summary" not in text
    assert "—" not in text


def test_onboarding_drops_signal_map_step():
    flow = (ROOT / "frontend/src/pages/OnboardingFlow.jsx").read_text(encoding="utf-8")
    chrome = (ROOT / "frontend/src/components/onboarding/OnboardingChrome.jsx").read_text(encoding="utf-8")
    assert "Signal map" not in flow
    assert "Signal map" not in chrome
    assert "onboarding-analysis__orb" not in flow
    assert "Skip keys" in flow


def test_register_marks_onboarding_pending():
    src = (ROOT / "frontend/src/pages/RegisterPage.jsx").read_text(encoding="utf-8")
    assert "markOnboardingPending" in src
    login = (ROOT / "frontend/src/pages/LoginPage.jsx").read_text(encoding="utf-8")
    assert "shouldRunOnboarding" in login
    assert "/app/onboarding" in login
