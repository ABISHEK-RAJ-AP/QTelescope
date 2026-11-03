from app.api.auth import CAPTCHA_LEN, generate_captcha_image, generate_captcha_svg


def test_png_captcha_is_data_uri():
    uri = generate_captcha_image("A3K7P2")
    assert uri.startswith("data:image/")
    assert "base64," in uri or "svg" in uri
    assert CAPTCHA_LEN == 6


def test_svg_fallback_contains_code():
    from urllib.parse import unquote
    uri = generate_captcha_svg("A3K7P2")
    decoded = unquote(uri)
    assert uri.startswith("data:image/svg")
    for ch in "A3K7P2":
        assert f">{ch}</text>" in decoded
