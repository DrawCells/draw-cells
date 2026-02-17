"use client";

import { useEffect } from "react";
import { useDispatch } from "react-redux";
import HomeHeader from "../../Header/components/HomeHeader";
import PresentationsList from "./PresentationsList";
import { setUser } from "../reducers";
import { getSession } from "../../../app/login/actions";

export default function Home() {
  const dispatch = useDispatch();

  useEffect(() => {
    getSession().then((user) => {
      dispatch(setUser(user));
    });
  }, [dispatch]);

  return (
    <>
      <HomeHeader />
      <PresentationsList />
    </>
  );
}
