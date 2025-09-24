class ModelRequest:
    def __init__(self, name, email, project_description, filename):
        self.name = name
        self.email = email
        self.project_description = project_description
        self.filename = filename

    def to_dict(self):
        """A simple object mapping implementation."""
        return {
            'name': self.name,
            'email': self.email,
            'project_description': self.project_description,
            'filename': self.filename
        }