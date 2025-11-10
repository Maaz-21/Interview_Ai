import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/actions/auth.action";
import LogoutButton from "@/components/LogoutButton";

export default async function Layout({ children }) {
    const isUserAuthenticated = await isAuthenticated();
    if (!isUserAuthenticated) redirect("/sign-in");

    return (
        <div className="root-layout">
            <nav className="flex items-center justify-between">
                <Link href="/" className="flex gap-3">
                    <Image src="/logo2.png" alt="MockMate Logo" width={38} height={32} style={{ width: "auto", height: "auto" }} />
                    <h2 className="text-primary-100">MockMate</h2>
                </Link>

                <div>
                    <LogoutButton>Exit</LogoutButton>
                </div>
            </nav>

            {children}
        </div>
    );
}
