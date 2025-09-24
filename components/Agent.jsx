"use client";
import Image from "next/image";
import {use, useState} from "react";
import { cn } from "@/lib/utils";

const CallStatus= {
    INACTIVE: 'INACTIVE',
    CONNECTING: 'CONNECTING',
    ACTIVE: 'ACTIVE',
    FINISHED: 'FINISHED'
}

function Agent({ username, userId, type }) {
    const isSpeaking = true;
    const [callStatus, setCallStatus]= useState(CallStatus.FINISHED)
    const messages = [
        "Nice to meet you",
        "test",
        "tst2"
    ];
    const lastMessage = messages[messages.length - 1];
    return (
        <>
        <div className="call-view">
            <div className="card-interviewer ">
                <div className="avatar">
                    <Image src="/ai-avatar.png" className="object-cover" alt="vapi" width={65} height={54} style={{ width: "auto", height: "auto" }}/> 
                    {isSpeaking && <span className="animate-speak"></span>}
                </div>
                <h3>AI Interviewer</h3>
            </div>
            <div className="card-border">
                <div className="card-content">
                    <Image src="/user-avatar.png" className="rounded-full object-cover size-[120px]" alt="user-avatar" width={150} height={150} style={{ width: "auto", height: "auto" }} />
                    <h3>{username || "User"}</h3>
                </div>
            </div>
        </div>
        {messages.length >0 && (
            <div className="transcript-border">
                <div className="transcript">
                    <p key={lastMessage} className={cn('transition-opacity duration-500 opacity-0','animate-fadeIn opacity-100')}>{lastMessage}</p>
                </div>
            </div>
        )}
        <div className="w-full flex justify-center">
            {callStatus !== 'ACTIVE' ?  
            (
                <button className="relative btn-call">
                    <span>
                    {callStatus ==='INACTIVE'|| callStatus === 'FINISHED' ? 'Call' : '. . .'}
                    </span>
                </button>
            ): 
            (
                <button className="btn-disconnect">End</button>
            )
            }
        </div>
        </>
     );
}

export default Agent;