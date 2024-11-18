from flask import Flask
from flask_cors import CORS
import ssl
import socket

from routes import api, static
from config import (
    HOST,
    PORT,
    DEBUG,
    SSL_CERT_PATH,
    SSL_KEY_PATH,
    logger
)
from utils import get_local_ip

def create_app():
    """Create and configure the Flask application."""
    app = Flask(__name__, static_folder='.')
    
    # Enable CORS
    CORS(app, resources={r"/*": {"origins": "*"}})
    
    # Register blueprints
    app.register_blueprint(api, url_prefix='/api/v1')
    app.register_blueprint(static)
    
    return app

def setup_ssl():
    """Set up SSL context for HTTPS."""
    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ssl_context.load_cert_chain(SSL_CERT_PATH, SSL_KEY_PATH)
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    return ssl_context

def print_server_info():
    """Print server access information."""
    local_ip = get_local_ip()
    
    print(f"\nLucy v4 Server Running!")
    print(f"======================")
    print(f"Local Access:")
    print(f"Teacher's page: https://localhost:{PORT}")
    print(f"Student's page: https://localhost:{PORT}/student")
    print(f"\nNetwork Access:")
    print(f"Teacher's page: https://{local_ip}:{PORT}")
    print(f"Student's page: https://{local_ip}:{PORT}/student")
    print(f"======================\n")

def main():
    """Main application entry point."""
    try:
        # Create and configure the application
        app = create_app()
        
        # Set up SSL
        ssl_context = setup_ssl()
        
        # Print access information
        print_server_info()
        
        # Run the server
        app.run(
            host=HOST,
            port=PORT,
            ssl_context=ssl_context,
            debug=DEBUG
        )
    except Exception as e:
        logger.error(f"Failed to start server: {str(e)}", exc_info=True)
        raise

if __name__ == '__main__':
    main()
