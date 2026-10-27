"""One explicit development-only capability; packaged distributions fail closed."""
import os
import sys
from pathlib import Path

LOOPS_UNAVAILABLE = 'Loop creation is unavailable in this distribution; existing audio and metadata are preserved.'


def loop_creation_enabled(home: Path) -> bool:
    stable = (Path.home() / '.sonariel').resolve()
    profile = home.resolve()
    return (not getattr(sys, 'frozen', False)
            and os.environ.get('SONARIEL_DEVELOPMENT_LOOPS') == '1'
            and profile != stable and stable not in profile.parents)


def require_loop_creation(home: Path) -> None:
    if not loop_creation_enabled(home):
        raise ValueError(LOOPS_UNAVAILABLE)
