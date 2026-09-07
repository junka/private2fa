import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/configs/nextauth";

import SignInCard from "@/components/signin-card";

const SignInPage = async () => {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    redirect("/otp");
  }

  return <SignInCard />;
};

export default SignInPage;