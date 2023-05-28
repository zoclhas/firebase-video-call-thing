import React, { useState, useRef, useEffect } from "react";

import { Button } from "@/components/ui/button";

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, getDoc } from "firebase/firestore";

const App = () => {
    const [joinID, setJoinID] = useState("");
    const [initScreen, setinitScreen] = useState(true);
    const [localStream, setLocalStream] = useState();
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    // Getting the join ID
    const params = new Proxy(new URLSearchParams(window.location.search), {
        get: (searchParams, prop) => searchParams.get(prop),
    });
    useEffect(() => {
        if (params.join) {
            setJoinID(params.join);
        }
    }, [params]);

    //  Firebase init
    const firebaseConfig = {
        apiKey: import.meta.env.VITE_API_KEY,
        authDomain: import.meta.env.VITE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_APP_ID,
        measurementId: import.meta.env.VITE_MEASUREMENT_ID,
    };

    const fbApp = initializeApp(firebaseConfig);
    const db = getFirestore(fbApp);
    const servers = {
        iceServers: [
            {
                urls: [
                    "stun:stun1.l.google.com:19302",
                    "stun:stun2.l.google.com:19302",
                ],
            },
        ],
        iceCandidatePoolSize: 10,
    };

    // Global Vars
    const pc = new RTCPeerConnection(servers);
    let remoteStream = null;

    // HTML Els
    const webcamVideoRef = useRef(null);
    const callButton = document.getElementById("callButton");
    const callInput = document.getElementById("callInput");
    const answerButton = document.getElementById("answerButton");
    const remoteVideo = document.getElementById("remoteVideo");
    const hangupButton = document.getElementById("hangupButton");

    const startCamera = async () => {
        setIsCameraOpen(true);
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
        });
        setLocalStream(stream);
        remoteStream = new MediaStream();

        // Push tracks from local stream to peer connection
        stream.getTracks().forEach((track) => {
            pc.addTrack(track, stream);
        });

        // Pull tracks from remote stream, add to video stream
        pc.ontrack = (event) => {
            event.streams[0].getTracks().forEach((track) => {
                remoteStream.addTrack(track);
            });
        };

        webcamVideoRef.current.srcObject = stream;
        // remoteVideo.srcObject = remoteStream;

        // callButton.disabled = false;
        // answerButton.disabled = false;
        // webcamButton.disabled = true;
    };

    const stopCamera = () => {
        localStream.getTracks().forEach((track) => track.stop());
        setIsCameraOpen(false);
    };

    const createRoom = async () => {
        const callDoc = await getDocs(collection(db, "calls"));
        // const offerCandidates = collection(callDoc, "offerCandidates");

        // const answerCandidates = callDoc.collection("answerCandidates");

        setJoinID(callDoc.id);

        // Get candidates for caller, save to db
        pc.onicecandidate = (event) => {
            console.log(event);
            event.candidate && offerCandidates.add(event.candidate.toJSON());
        };

        // Create offer
        const offerDescription = await pc.createOffer();
        await pc.setLocalDescription(offerDescription);

        const offer = {
            sdp: offerDescription.sdp,
            type: offerDescription.type,
        };

        await callDoc.set({ offer });

        // Listen for remote answer
        callDoc.onSnapshot((snapshot) => {
            const data = snapshot.data();
            if (!pc.currentRemoteDescription && data?.answer) {
                const answerDescription = new RTCSessionDescription(
                    data.answer
                );
                pc.setRemoteDescription(answerDescription);
            }
        });

        // When answered, add candidate to peer connection
        answerCandidates.onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const candidate = new RTCIceCandidate(change.doc.data());
                    pc.addIceCandidate(candidate);
                }
            });
        });

        // hangupButton.disabled = false;
    };

    return (
        <main className="mx-auto max-w-[450px] h-screen px-4 py-4 overflow-hidden">
            <div
                id="view"
                className="h-full w-full bg-slate-800 rounded-3xl overflow-hidden relative"
            >
                {initScreen && (
                    <div className="h-full w-full flex flex-col gap-8 items-center justify-center relative">
                        {isCameraOpen ? (
                            <Button
                                variant="secondary"
                                className="w-full max-w-[200px]"
                                onClick={startCamera}
                            >
                                Start Camera
                            </Button>
                        ) : (
                            <>
                                <Button
                                    variant="secondary"
                                    className="w-full max-w-[200px]"
                                    onClick={stopCamera}
                                >
                                    Stop Camera
                                </Button>
                                <div className="flex flex-col gap-4 w-full items-center">
                                    <Button
                                        className="w-full max-w-[200px]"
                                        onClick={createRoom}
                                    >
                                        Create Call
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                <video
                    ref={webcamVideoRef}
                    id="webcamVideo"
                    autoPlay
                    playsInline
                    muted
                    className="w-full max-w-[90px] aspect-[9/16] bg-white absolute bottom-4 right-4 rounded-2xl overflow-hidden object-cover object-center shadow-md"
                />
            </div>
        </main>
    );
};

export default App;
