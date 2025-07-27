class Project:
    def __init__(self, name, path, desc):
        self.name = name
        self.path = path
        self.desc = desc

    def to_dict(self):
        return {'name': self.name, 'path': self.path, 'desc': self.desc}
