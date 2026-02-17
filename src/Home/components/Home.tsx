"use client";

import { useEffect } from "react";
import { useDispatch } from "react-redux";
import HomeHeader from "../../Header/components/HomeHeader";
import PresentationsList from "./PresentationsList";
import { setUser } from "../reducers";

interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
}

interface HomeProps {
  user: User;
  presentations: Record<string, { title: string; previewImage?: string }>;
}

export default function Home({ user, presentations }: HomeProps) {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(setUser(user));
  }, [dispatch, user]);

  return (
    <>
      <HomeHeader />
      <PresentationsList user={user} initialPresentations={presentations} />
    </>
  );
}
