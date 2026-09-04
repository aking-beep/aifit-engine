"""AI Fit Engine core package."""

from .engine import score_session
from .models import AssessmentSession, UserFitVector

__version__ = "0.2.0"
__all__ = ["AssessmentSession", "UserFitVector", "score_session", "__version__"]
