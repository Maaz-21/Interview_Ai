"use client"

import Image from "next/image"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {Form} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import FormField from "./FormField"
import { useRouter } from "next/navigation"
import { auth } from "@/firebase/client";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { signUp, signIn } from "@/lib/actions/auth.action";
const authFormSchema =(type) => {
    return z.object({
        name: type === "sign-up" ? z.string().min(3) : z.string().optional(),
        email: z.email(),
        password: z.string().min(3).max(50),
})
}
function AuthForm({type}) {
    const router = useRouter();
    const formSchema = authFormSchema(type);
    const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  })
 
  // 2. Define a submit handler.
async function onSubmit(values) {
    try{
       if(type === "sign-up"){
            const {name, email, password} =values;
            const userCredentials = await createUserWithEmailAndPassword(auth, email, password);
            const result = await signUp({
                uid: userCredentials.user.uid,
                name: name,
                email,
                password
            });
            if(!result?.success){
                toast.error(result?.message);
                return;
            }
            toast.success("Account created successfully!. Please sign in.");
            router.push('/sign-in');
       }else{
            const {email, password} = values;
            const userCredentials = await signInWithEmailAndPassword(auth, email, password);
            const idToken = await userCredentials.user.getIdToken();
            if(!idToken){
                toast.error("SignIn Failed");
                return;
            }
            await signIn({
                email, idToken
            })
            toast.success("Logged in successfully!");
            router.push('/');
       }
    }catch(error){
        console.log(error);
        if(error?.code){
            switch (error.code) {
                case "auth/invalid-email":
                    toast.error("Invalid email format. Please check your email.");
                    break;
                case "auth/user-not-found":
                    toast.error("No user found with this email.");
                    break;
                case "auth/invalid-credential":
                    toast.error("Incorrect password. Please try again.");
                    break;
                case "auth/too-many-requests":
                    toast.error("Too many failed attempts. Try again later.");
                    break;
                default:
                    toast.error("Authentication failed. Please try again.");
                    break;
            }
        }else{
            toast.error(`There was an error: ${error.message || error}`);
        }
    }
  }
  const isSignIn = type === 'sign-in';
    return (
        <div className="card-border lg:min-w-[566px]">
            <div className="flex flex-col gap-6 card py-14 px-10">
                <div className="flex flex-row gap-2 justify-center">
                    <Image src="/logo.svg" alt="Logo" height={32} width={32} style={{ width: "auto", height: "auto" }}/>
                    <h2 className="text-primary-100">MockMate</h2>
                </div>
                <h3 className="text-center">Practice job interviews with AI</h3>
            
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-6 mt-4 form">
                        {!isSignIn && <FormField control={form.control} name="name" label="Name" placeholder="John Doe" />}
                        <FormField control={form.control} name="email" label="Email" placeholder="you@example.com" type="email" />
                        <FormField control={form.control} name="password" label="Password" placeholder="••••••••" type="password" />
                        <Button className="btn" type="submit">{isSignIn ? "Sign In" : "Create an Account"}</Button>
                    </form>
                </Form>
                <p className="text-center">
                    {isSignIn ? "No account yet? " : "Already have an account?"}
                    <Link 
                       href={!isSignIn ? "/sign-in" : "/sign-up"}
                       className="font-bold text-user-primary ml-1">
                        {isSignIn ? "Sign Up" : "Sign In"}
                    </Link>
                </p>
            </div>
        </div>
    );
}

export default AuthForm;