

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/configs/nextauth";

import SignInButton from "@/components/signinbutton";

const SignInPage = async () => {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    redirect("/otp");
  } else {
    return (
      <div className="flex justify-center items-center">

      <div className="flex justify-center items-center">
        <SignInButton provider={"github"} />
      </div>
      <span></span>
      <div className="flex justify-center items-center">
        <SignInButton provider={"google"} />
        </div>
      </div>
    );
  }
};

export default SignInPage;