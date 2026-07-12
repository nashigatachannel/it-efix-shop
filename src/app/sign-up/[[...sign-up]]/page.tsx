import { SignUp } from "@clerk/nextjs";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function SignUpPage() {
  return (
    <>
      <Header />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <SignUp />
      </main>
      <Footer />
    </>
  );
}
