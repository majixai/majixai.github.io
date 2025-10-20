from app import app, db
from app.models.user import User

with app.app_context():
    db.create_all()
    if not User.query.first():
        user = User(username='testuser', email='test@example.com')
        db.session.add(user)
        db.session.commit()

if __name__ == '__main__':
    app.run(debug=True)
