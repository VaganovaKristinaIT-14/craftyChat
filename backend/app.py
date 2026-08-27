# ============================================
# APP — точка входа CraftyChat backend (Flask)
# ============================================
import os
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

import config
from routes.presets_routes import bp as presets_bp
from routes.characters_routes import bp as characters_bp
from routes.personas_routes import bp as personas_bp
from routes.lorebooks_routes import bp as lorebooks_bp
from routes.chats_routes import bp as chats_bp
from routes.background_routes import bp as background_bp
from routes.settings_routes import bp as settings_bp

FRONTEND_DIR = os.path.abspath(os.path.join(config.BASE_DIR, '..', 'frontend'))


def create_app():
    app = Flask(__name__, static_folder=None)
    app.config["JSON_AS_ASCII"] = False
    app.config["MAX_CONTENT_LENGTH"] = config.MAX_UPLOAD_SIZE_BYTES * 2

    CORS(app)  # на случай запуска фронтенда отдельным сервером при разработке

    app.register_blueprint(presets_bp)
    app.register_blueprint(characters_bp)
    app.register_blueprint(personas_bp)
    app.register_blueprint(lorebooks_bp)
    app.register_blueprint(chats_bp)
    app.register_blueprint(background_bp)
    app.register_blueprint(settings_bp)

    @app.get("/api/health")
    def health():
        from utils.tokens import is_tiktoken_available
        return jsonify({
            "status": "ok",
            "service": "CraftyChat backend",
            "tiktoken_available": is_tiktoken_available(),
            "frontend_dir_found": os.path.isdir(FRONTEND_DIR),
        })

    # ---------- Отдача фронтенда (SPA) ----------
    @app.get("/")
    def serve_index():
        return send_from_directory(FRONTEND_DIR, "index.html")

    @app.get("/<path:path>")
    def serve_static(path):
        full_path = os.path.join(FRONTEND_DIR, path)
        if os.path.isfile(full_path):
            return send_from_directory(FRONTEND_DIR, path)
        # неизвестный путь фронтенда — отдаём index.html (SPA fallback)
        return send_from_directory(FRONTEND_DIR, "index.html")

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Не найдено"}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": "Внутренняя ошибка сервера", "details": str(e)}), 500

    return app


app = create_app()

if __name__ == "__main__":
    print(f"🚀 CraftyChat запущен: http://localhost:{config.PORT}")
    print(f"   Frontend: {FRONTEND_DIR} (найден: {os.path.isdir(FRONTEND_DIR)})")
    print(f"   API:      http://localhost:{config.PORT}/api/health")
    app.run(host=config.HOST, port=config.PORT, debug=config.DEBUG)
