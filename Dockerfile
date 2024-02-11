# Use the official Node.js image as the base image
FROM node:18

# Install the application dependencies
RUN npm install

# Define the entry point for the container
CMD ["npm", "start"]
