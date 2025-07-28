from flask import Flask

def create_app():
    app = Flask(__name__)

    # Register blueprints/controllers here
    from .controllers.main_controller import main_bp
    app.register_blueprint(main_bp)

    from .controllers.genai_controller import genai_bp
    app.register_blueprint(genai_bp)

    from .controllers.git_action_controller import git_action_bp
    app.register_blueprint(git_action_bp)

    from .controllers.server_comm_controller import server_comm_bp
    app.register_blueprint(server_comm_bp)
    return app
