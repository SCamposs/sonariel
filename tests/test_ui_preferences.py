import pytest
from jsonschema import ValidationError

from sonariel.service import Service
from sonariel.store import Store


def test_new_profile_keeps_unconfirmed_language_across_restarts(tmp_path):
    store = Store(tmp_path)
    expected = {"locale": None, "existing_installation": False}
    assert store.setting("ui_preferences") == expected
    assert Store(tmp_path).setting("ui_preferences") == expected


def test_existing_profile_preserves_settings_and_projects(tmp_path):
    store = Store(tmp_path)
    service = Service(store, start_worker=False)
    project = service.invoke("project_create", {"name": "Original project"})
    service.invoke("preferences_save", {"idle_minutes": 17})
    store.set("unrelated", {"keep": True})
    # Simulate a v0.3.2 database, which has no locale preference.
    store.execute("DELETE FROM settings WHERE key='ui_preferences'")
    migrated = Store(tmp_path)
    assert migrated.setting("ui_preferences") == {"locale": None, "existing_installation": True}
    service = Service(migrated, start_worker=False)
    assert service.invoke("ui_preferences_save", {"locale": "en"})["locale"] == "en"
    assert Store(tmp_path).setting("ui_preferences")["locale"] == "en"
    assert migrated.setting("preferences") == {"idle_minutes": 17}
    assert migrated.setting("unrelated") == {"keep": True}
    assert service.invoke("projects_list")[0]["id"] == project["project_id"]
    with pytest.raises(ValidationError):
        service.invoke("ui_preferences_save", {"locale": "invalid"})


def test_language_change_does_not_touch_jobs_or_generation_preferences(tmp_path):
    service = Service(Store(tmp_path), start_worker=False)
    service.store.set("preferences", {"idle_minutes": 15, "future_setting": True})
    before = service.store.rows("SELECT * FROM jobs")
    service.active = True
    service.invoke("ui_preferences_save", {"locale": "pt-BR"})
    assert service.store.rows("SELECT * FROM jobs") == before
    assert service.active is True
    assert service.store.setting("preferences") == {"idle_minutes": 15, "future_setting": True}
