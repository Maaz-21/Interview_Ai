import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Eye, EyeOff } from "lucide-react"
import { Controller } from "react-hook-form"
import { FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"

function FormField({control, name, label, placeholder, type="text"}) {
    const isPasswordField = type === "password";
    const [showPassword, setShowPassword] = useState(false);

    const resolvedType = isPasswordField && showPassword ? "text" : type;

    return ( 
            <Controller
                        control={control}
                        name={name}
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel className="label">{label}</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Input type={resolvedType} className={`input ${isPasswordField ? "pr-10" : ""}`} placeholder={placeholder} {...field} />
                                    {isPasswordField && (
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((prev) => !prev)}
                                            className="absolute inset-y-0 right-2 my-auto flex h-8 w-8 items-center justify-center rounded-full bg-transparent transition-colors z-20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200"
                                            style={{ color: "var(--color-light-100)" }}
                                            aria-label={showPassword ? "Hide password" : "Show password"}
                                        >
                                            {showPassword ? <EyeOff size={16} className="pointer-events-none" /> : <Eye size={16} className="pointer-events-none" />}
                                        </button>
                                    )}
                                </div>
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
     );
} 

export default FormField;