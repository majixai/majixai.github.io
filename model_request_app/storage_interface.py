from abc import ABC, abstractmethod

class StorageInterface(ABC):
    """
    An interface for storage managers. This demonstrates the concept of an
    interface in Python using Abstract Base Classes (ABC).
    """

    @abstractmethod
    def save(self, file):
        """Saves a file and returns its name."""
        pass

    @abstractmethod
    def list(self):
        """A generator that yields the names of all stored files."""
        pass

    @abstractmethod
    def is_allowed(self, filename):
        """Checks if a file type is allowed."""
        pass