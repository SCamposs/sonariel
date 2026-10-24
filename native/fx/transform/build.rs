fn main() {
    cc::Build::new()
        .cpp(true)
        .std("c++17")
        .include("../vendor/signalsmith-stretch")
        .include("../vendor")
        .file("native/stretch.cpp")
        .flag_if_supported("/bigobj")
        .opt_level(2)
        .compile("essence_stretch");
    println!("cargo:rerun-if-changed=native/stretch.cpp");
    println!("cargo:rerun-if-changed=../vendor/signalsmith-stretch/signalsmith-stretch.h");
}
