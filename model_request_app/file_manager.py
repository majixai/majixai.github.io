import os
from werkzeug.utils import secure_filename
from storage_interface import StorageInterface

class FileManager(StorageInterface):
    """
    Manages file storage, implementing the StorageInterface.
    This class demonstrates inheritance, generators, and public/protected members.
    """
    def __init__(self, upload_folder, allowed_extensions):
        self._upload_folder = upload_folder  # Protected member
        self._allowed_extensions = allowed_extensions
        if not os.path.exists(self._upload_folder):
            os.makedirs(self._upload_folder)

    def is_allowed(self, filename):
        """
        Checks if the file's extension is allowed. Implements the abstract method.
        """
        return '.' in filename and \
               filename.rsplit('.', 1)[1].lower() in self._allowed_extensions

    def save(self, file):
        """
        Saves the uploaded file to the upload folder. Implements the abstract method.
        """
        if file and self.is_allowed(file.filename):
            filename = secure_filename(file.filename)
            file.save(os.path.join(self._upload_folder, filename))
            return filename
        return None

    def list(self):
        """
        A generator that yields the names of all stored files.
        Implements the abstract method.
        """
        for filename in os.listdir(self._upload_folder):
            yield filename