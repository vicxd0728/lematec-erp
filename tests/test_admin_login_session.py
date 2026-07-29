from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")


def test_admin_pin_can_be_reused_only_for_current_browser_session():
    assert "ADMIN_ROLE_PIN_SESSION_PREFIX" in INDEX
    assert "allowSessionReuse&&sessionStorage.getItem(adminRolePinSessionKey(role))==='1'" in INDEX
    assert "verifyAdminRolePin(r,{allowSessionReuse:true})" in INDEX
    assert "markAdminRolePinVerified(role)" in INDEX


def test_logout_clears_admin_pin_session():
    assert "clearAdminRolePinSessions()" in INDEX


def test_auto_login_sets_token_before_remote_pin_sync():
    start = INDEX.index("window.onload=async")
    section = INDEX[start : start + 900]
    assert section.index("TOKEN=t;") < section.index("syncPermissionPinsFromNotion")
    assert section.index("syncPermissionPinsFromNotion") < section.index("verifyAdminRolePin")


def test_service_worker_does_not_force_activate_during_install():
    install_start = SW.index("self.addEventListener('install'")
    install_end = SW.index("self.addEventListener('activate'")
    assert "skipWaiting" not in SW[install_start:install_end]
    assert "hadServiceWorkerController" in INDEX
