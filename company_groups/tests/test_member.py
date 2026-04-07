"""
Unit tests for Member model
"""
import unittest
from company_groups.src.member import Member, MemberRole, MemberCollection, member_generator


class TestMember(unittest.TestCase):

    def test_member_creation(self):
        """Test creating a member."""
        member = Member(1, "John Doe", "john@example.com", MemberRole.PROFESSOR)
        self.assertEqual(member.member_id, 1)
        self.assertEqual(member.name, "John Doe")
        self.assertEqual(member.get_email(), "john@example.com")
        self.assertEqual(member.get_role(), MemberRole.PROFESSOR)

    def test_member_role_change(self):
        """Test changing member role."""
        member = Member(1, "Jane Doe", "jane@example.com", MemberRole.ASSISTANT)
        member.set_role(MemberRole.PROFESSOR)
        self.assertEqual(member.get_role(), MemberRole.PROFESSOR)

    def test_member_to_dict(self):
        """Test converting member to dictionary."""
        member = Member(1, "Mike Smith", "mike@example.com", MemberRole.GUEST_SPEAKER)
        data = member.to_dict()
        self.assertEqual(data["member_id"], 1)
        self.assertEqual(data["name"], "Mike Smith")
        self.assertEqual(data["email"], "mike@example.com")
        self.assertEqual(data["role"], "guest_speaker")

    def test_member_from_dict(self):
        """Test creating member from dictionary."""
        data = {
            "member_id": 2,
            "name": "Alice Johnson",
            "email": "alice@example.com",
            "role": "leader"
        }
        member = Member.from_dict(data)
        self.assertEqual(member.member_id, 2)
        self.assertEqual(member.name, "Alice Johnson")
        self.assertEqual(member.get_role(), MemberRole.LEADER)


class TestMemberCollection(unittest.TestCase):

    def test_collection_add_member(self):
        """Test adding members to collection."""
        collection = MemberCollection()
        member1 = Member(1, "User 1", "user1@test.com", MemberRole.PROFESSOR)
        member2 = Member(2, "User 2", "user2@test.com", MemberRole.ASSISTANT)
        
        collection.add_member(member1)
        collection.add_member(member2)
        
        self.assertEqual(len(collection), 2)

    def test_collection_remove_member(self):
        """Test removing a member from collection."""
        collection = MemberCollection()
        member = Member(1, "User 1", "user1@test.com", MemberRole.PROFESSOR)
        
        collection.add_member(member)
        self.assertEqual(len(collection), 1)
        
        result = collection.remove_member(1)
        self.assertTrue(result)
        self.assertEqual(len(collection), 0)

    def test_collection_get_by_role(self):
        """Test getting members by role."""
        collection = MemberCollection()
        collection.add_member(Member(1, "Prof 1", "prof1@test.com", MemberRole.PROFESSOR))
        collection.add_member(Member(2, "Assist 1", "assist1@test.com", MemberRole.ASSISTANT))
        collection.add_member(Member(3, "Prof 2", "prof2@test.com", MemberRole.PROFESSOR))
        
        professors = collection.get_by_role(MemberRole.PROFESSOR)
        self.assertEqual(len(professors), 2)
        
        assistants = collection.get_by_role(MemberRole.ASSISTANT)
        self.assertEqual(len(assistants), 1)

    def test_collection_iteration(self):
        """Test iterating through collection."""
        collection = MemberCollection()
        collection.add_member(Member(1, "A", "a@test.com", MemberRole.PROFESSOR))
        collection.add_member(Member(2, "B", "b@test.com", MemberRole.ASSISTANT))
        
        names = [m.name for m in collection]
        self.assertEqual(names, ["A", "B"])

    def test_member_generator(self):
        """Test member generator function."""
        collection = MemberCollection()
        collection.add_member(Member(1, "X", "x@test.com", MemberRole.LEADER))
        collection.add_member(Member(2, "Y", "y@test.com", MemberRole.GUEST_SPEAKER))
        
        gen = member_generator(collection)
        self.assertEqual(next(gen).name, "X")
        self.assertEqual(next(gen).name, "Y")


if __name__ == '__main__':
    unittest.main()
