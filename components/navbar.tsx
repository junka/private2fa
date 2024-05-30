import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/configs/nextauth";

const Navbar = async () => {
  const session = await getServerSession(authOptions);

  return (
    <nav className="bg-indigo-600 p-4">
      <ul className="flex gap-x-4">
        <li>
          <Link href="/" className="text-white hover:underline">
            Home
          </Link>
        </li>

        {!session ? (
          <li>
            <Link href="/signin" className="text-white hover:underline">
              Sign In
            </Link>
          </li>
        ) : (
          <>
            <li>
              <Link href="/profile" className="text-white hover:underline">
                Profile
              </Link>
            </li>

            <li>
              <Link href="/signout" className="text-white hover:underline">
                Sign Out
              </Link>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
};

export { Navbar };