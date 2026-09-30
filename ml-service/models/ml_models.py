"""ML model management and lifecycle."""

import joblib
import logging
from pathlib import Path
from typing import Any, Optional, Dict
from datetime import datetime
import json

logger = logging.getLogger(__name__)


class ModelRegistry:
    """Registry for managing trained ML models."""

    def __init__(self, models_dir: Path):
        """Initialize model registry."""
        self.models_dir = Path(models_dir)
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self.metadata_file = self.models_dir / "metadata.json"
        self.metadata = self._load_metadata()

    def _load_metadata(self) -> Dict[str, Any]:
        """Load metadata about trained models."""
        if self.metadata_file.exists():
            try:
                with open(self.metadata_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Error loading metadata: {e}")
        return {}

    def _save_metadata(self) -> None:
        """Save metadata to file."""
        try:
            with open(self.metadata_file, 'w') as f:
                json.dump(self.metadata, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Error saving metadata: {e}")

    def save_model(
        self,
        model: Any,
        model_name: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Save a trained model."""
        try:
            model_path = self.models_dir / f"{model_name}.pkl"
            joblib.dump(model, model_path)

            # Update metadata
            self.metadata[model_name] = {
                'path': str(model_path),
                'saved_at': datetime.now().isoformat(),
                'type': type(model).__name__,
                **metadata or {},
            }
            self._save_metadata()

            logger.info(f"Model {model_name} saved successfully")
            return True
        except Exception as e:
            logger.error(f"Error saving model {model_name}: {e}")
            return False

    def load_model(self, model_name: str) -> Optional[Any]:
        """Load a trained model."""
        try:
            if model_name not in self.metadata:
                logger.warning(f"Model {model_name} not found in metadata")
                return None

            model_path = Path(self.metadata[model_name]['path'])
            if not model_path.exists():
                logger.warning(f"Model file not found: {model_path}")
                return None

            model = joblib.load(model_path)
            logger.info(f"Model {model_name} loaded successfully")
            return model
        except Exception as e:
            logger.error(f"Error loading model {model_name}: {e}")
            return None

    def model_exists(self, model_name: str) -> bool:
        """Check if model exists."""
        if model_name not in self.metadata:
            return False
        model_path = Path(self.metadata[model_name]['path'])
        return model_path.exists()

    def get_model_info(self, model_name: str) -> Optional[Dict[str, Any]]:
        """Get model metadata."""
        return self.metadata.get(model_name)

    def list_models(self) -> Dict[str, Dict[str, Any]]:
        """List all available models."""
        return self.metadata

    def delete_model(self, model_name: str) -> bool:
        """Delete a model."""
        try:
            if model_name in self.metadata:
                model_path = Path(self.metadata[model_name]['path'])
                if model_path.exists():
                    model_path.unlink()
                del self.metadata[model_name]
                self._save_metadata()
                logger.info(f"Model {model_name} deleted")
                return True
        except Exception as e:
            logger.error(f"Error deleting model {model_name}: {e}")
        return False


class ModelTrainer:
    """Base class for model training."""

    def __init__(self, registry: ModelRegistry):
        """Initialize trainer."""
        self.registry = registry

    def train(self, *args, **kwargs) -> bool:
        """Train model. Override in subclass."""
        raise NotImplementedError

    def evaluate(self, *args, **kwargs) -> Dict[str, Any]:
        """Evaluate model. Override in subclass."""
        raise NotImplementedError

    def save(self, model_name: str, model: Any, metadata: Optional[Dict] = None) -> bool:
        """Save trained model."""
        return self.registry.save_model(model, model_name, metadata)

    def load(self, model_name: str) -> Optional[Any]:
        """Load trained model."""
        return self.registry.load_model(model_name)
