import { Input } from "@/components/ui/input"
import { Controller } from "react-hook-form"
import { FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"

function FormField({control, name, label, placeholder, type="text"}) {
    return ( 
            <Controller
                        control={control}
                        name={name}
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel className="label">{label}</FormLabel>
                            <FormControl>
                                <Input className="input" placeholder={placeholder} {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
     );
} 

export default FormField;