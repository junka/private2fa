
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/configs/nextauth";
import { TwoFactorAuth } from "@/configs/otp2fa";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return <div>Loading...</div>;
  }

  const fa = await TwoFactorAuth()

  return (
    <div >
      <h1>Profile</h1>
      <div >
        {session.user?.image && (
          <img 
            src={session.user?.image}
            alt={`${session.user?.name}'s avatar`}
            style={{ width: '100px', height: '100px', borderRadius: '50%' }}
          />
        )}
        <div className="flex justify-center items-center">Username: {session.user?.name}</div>
        <p></p>
        <div className="flex justify-center items-center">Email: {session.user?.email}</div>
        {/* Add more user information as needed */}
      </div>

      <div>{fa}</div>
    </div>
  );
}