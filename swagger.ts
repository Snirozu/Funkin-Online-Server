import swaggerAutogen from 'swagger-autogen';

const doc = {
  info: {
    title: 'Psyck Network API',
    description: [
      "This is the API specification for the Psych Online Network",
      "It's mostly an auto-doc, so information here can be incomplete",
      "",
      "### TERMS OF USAGE!!!!!",
      "You're not allowed to use this project in ways that are malicious or giving disadvantage to the user.",
      "**This API should only be used in Psych Online related projects.**",
      "Other use is not permitted, unless given permission by API owners.",
    ].join('\n'),
    version: '0.0.0'
  },
  host: 'https://funkin.sniro.boo'
};

const outputFile = './database/openapi.json';
const endpointsFiles = ['./src/site.ts']; 

swaggerAutogen({ openapi: '3.0.0' })(outputFile, endpointsFiles, doc);