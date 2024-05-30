import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/configs/nextauth";
// import { useSession, signIn, signOut } from "next-auth/react";

import SignOutButton from "@/components/signoutbutton";

const SignOutPage = async () => {
  const session = await getServerSession(authOptions);
  // const { data: session } = useSession();

  if (!session) {
    redirect("/");
  } else {
    return (
      <div className="flex justify-center items-center">

        <SignOutButton />
      </div>
    );
  }
};

export default SignOutPage;