export class ResponseError extends Error {
    constructor(msg: string) {
        super(msg);

        this.name = 'server.ResponseError';

        Object.setPrototypeOf(this, ResponseError.prototype);
    }
}