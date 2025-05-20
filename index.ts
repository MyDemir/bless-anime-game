import { WebServer } from '@blockless/sdk-ts'; // WebServer'ı doğrudan ana SDK'dan import etmeyi deneyin.
const server = new WebServer();

server.statics('public', '/');
server.start();
