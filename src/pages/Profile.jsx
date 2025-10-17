import React from "react";
import NavBar from "../components/NavBar";

export default function Profile({ user }) {
  return <div className="cc-container">User Profile Page
  <NavBar profileImageSrc={user.avatar}/>
  </div>;
}
