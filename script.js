document.addEventListener("DOMContentLoaded", function() {
    // Create a button element dynamically
    const button = document.createElement('button');
    button.textContent = "Click me!";
    
    // Add an event listener to the button
    button.addEventListener("click", function() {
        alert("Button clicked! Welcome to the interactive website!");
    });

    // Append the button to the main content
    document.querySelector('main').appendChild(button);
});
