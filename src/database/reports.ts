import { ResponseError } from "../error";
import { prisma } from "./db";

export class Reports {
    async submit(id: string, content: any) {
        if (!id)
            throw new ResponseError('Can\'t submit, ID is null.')

        return (await prisma.report.create({
            data: {
                by: id,
                content: content
            },
        }));
    }

    async list() {
        return (await prisma.report.findMany());
    }
    
    async getByID(id: string) {
        return (await prisma.report.findUnique({
            where: {
                id: id
            }
        }));
    }
    
    async remove(id:string) {
        return (await prisma.report.delete({
            where: {
                id: id
            }
        }));
    }
}