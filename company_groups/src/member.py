"""
Member module - Represents company members (Professors, Assistants, Guest Speakers)
"""
from enum import Enum


class MemberRole(Enum):
    """Enumeration of member roles within a company."""
    PROFESSOR = "professor"
    LEADER = "leader"
    ASSISTANT = "assistant"
    GUEST_SPEAKER = "guest_speaker"


def log_method_call(func):
    """Decorator for logging method calls."""
    def wrapper(*args, **kwargs):
        print(f"Calling method: {func.__name__}")
        return func(*args, **kwargs)
    return wrapper


class Member:
    """Represents a member of a company group."""
    
    def __init__(self, member_id: int, name: str, email: str, role: MemberRole):
        self.member_id = member_id
        self.name = name
        self._email = email  # Protected member
        self.__role = role  # Private member
    
    @log_method_call
    def get_role(self) -> MemberRole:
        """Returns the role of the member."""
        return self.__role
    
    @log_method_call
    def set_role(self, new_role: MemberRole) -> None:
        """Sets a new role for the member."""
        if isinstance(new_role, MemberRole):
            self.__role = new_role
        else:
            print("Invalid role type.")
    
    def get_email(self) -> str:
        """Returns the email of the member."""
        return self._email
    
    def to_dict(self) -> dict:
        """Converts member to dictionary representation."""
        return {
            "member_id": self.member_id,
            "name": self.name,
            "email": self._email,
            "role": self.__role.value
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Member':
        """Creates a Member instance from dictionary."""
        return cls(
            member_id=data["member_id"],
            name=data["name"],
            email=data["email"],
            role=MemberRole(data["role"])
        )


class MemberCollection:
    """A collection of members that acts as an iterator."""
    
    def __init__(self):
        self._members = []
    
    def add_member(self, member: Member) -> None:
        """Add a member to the collection."""
        self._members.append(member)
    
    def remove_member(self, member_id: int) -> bool:
        """Remove a member by ID."""
        for i, member in enumerate(self._members):
            if member.member_id == member_id:
                self._members.pop(i)
                return True
        return False
    
    def get_by_role(self, role: MemberRole) -> list:
        """Get all members with a specific role."""
        return [m for m in self._members if m.get_role() == role]
    
    def __iter__(self):
        self.index = 0
        return self
    
    def __next__(self):
        if self.index < len(self._members):
            result = self._members[self.index]
            self.index += 1
            return result
        else:
            raise StopIteration
    
    def __len__(self):
        return len(self._members)


def member_generator(collection: MemberCollection):
    """A generator that yields each member from the collection."""
    for member in collection:
        yield member
