
import { PrismaClient } from '@prisma/client';
import { TOTP} from 'otpauth'

export  const prisma = new PrismaClient();

export async function insertOtp(totp : TOTP) {
    return prisma.optsecret.create({
        data: {
            label: totp.label,
            secret: totp.secret,
            algorithm: totp.algorithm,
            issuer: totp.issuer,
            period: totp.period,
            digits: totp.digits,
        }
    })
}

export async function findOtp() {
    const allotp = await prisma.optsecret.findMany();
    console.log(allotp[0])
    return allotp[0]
}