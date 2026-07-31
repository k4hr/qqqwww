"use client";
import { createContext, useContext, useEffect, useState } from "react";
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:"accepted"|"dismissed"}>};
const C=createContext<{event:InstallEvent|null;installed:boolean}>({event:null,installed:false});
export function PwaProvider({children}:{children:React.ReactNode}){const[event,setEvent]=useState<InstallEvent|null>(null);const[installed,setInstalled]=useState(false);useEffect(()=>{if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});const check=()=>setInstalled(window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator&{standalone?:boolean}).standalone));check();const before=(e:Event)=>{e.preventDefault();setEvent(e as InstallEvent)};const done=()=>{setInstalled(true);setEvent(null)};window.addEventListener("beforeinstallprompt",before);window.addEventListener("appinstalled",done);return()=>{window.removeEventListener("beforeinstallprompt",before);window.removeEventListener("appinstalled",done)}} ,[]);return <C.Provider value={{event,installed}}>{children}</C.Provider>};
export const usePwaInstall=()=>useContext(C);
