"use client";

import { signIn } from "next-auth/react";

const SignInButton = ({provider} : any) => {
  return (
    <button
      className="bg-slate-600 px-4 py-2 text-white"
      onClick={() => signIn(provider, { callbackUrl: "/" })}
      type="button"
    >
      SignIn with {provider}
    </button>
  );
};

export default SignInButton;