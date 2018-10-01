const config = {};

config.port = 3000;
config.database = {
    url: "mongodb://127.0.0.1:27017/todoDb"
}
config.allowedOrigins = "*"
config.version = "/api/v1"
config.env = "dev"
config.tokenExpiry = 1000 //token expires after this many hours
config.pageSize = 10


module.exports = config;