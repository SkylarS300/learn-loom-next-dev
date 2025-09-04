// app/signup/page.jsx (SERVER)
import { Suspense } from "react";
import SignupClient from "./SignupClient";

export default function SignupPage() {
    return (
        <Suspense fallback={null}>
            <SignupClient />
        </Suspense>
    );
}