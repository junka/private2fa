-- CreateTable
CREATE TABLE "optsecret" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "period" INTEGER NOT NULL,
    "digits" INTEGER NOT NULL,

    CONSTRAINT "optsecret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "userauth" (
    "id" SERIAL NOT NULL,
    "userid" INTEGER NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "userauth_pkey" PRIMARY KEY ("id")
);
