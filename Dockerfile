ARG NODE_VERSION=20.12.2

FROM node:${NODE_VERSION}-alpine
WORKDIR /usr/src/app
COPY . .
run npm install
run npm audit fix
EXPOSE 80
CMD ["node", "index.js", "80"]
